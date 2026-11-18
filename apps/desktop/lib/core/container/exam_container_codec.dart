import 'dart:convert';
import 'dart:typed_data';
import '../constants/app_constants.dart';
import 'exam_container_models.dart';

class ExamContainerCodec {
  static bool areByteArraysEqual(Uint8List firstList, Uint8List secondList) {
    if (firstList.length != secondList.length) {
      return false;
    }
    for (int index = 0; index < firstList.length; index++) {
      if (firstList[index] != secondList[index]) {
        return false;
      }
    }
    return true;
  }

  static Uint8List encode(EncodeExamContainerArguments arguments) {
    final formatVersion = arguments.formatVersion ?? AppConstants.currentFormatVersion;
    final algorithmIdentifier = arguments.algorithmIdentifier ?? AppConstants.algorithmAes256Gcm;

    if (arguments.keyIdentifier.length != AppConstants.keyIdentifierByteLength) {
      throw ArgumentError(
        'Invalid key identifier byte length: expected ${AppConstants.keyIdentifierByteLength}, received ${arguments.keyIdentifier.length}'
      );
    }

    if (arguments.nonce.length != AppConstants.nonceByteLength) {
      throw ArgumentError(
        'Invalid nonce byte length: expected ${AppConstants.nonceByteLength}, received ${arguments.nonce.length}'
      );
    }

    if (arguments.authenticationTag.length != AppConstants.authenticationTagByteLength) {
      throw ArgumentError(
        'Invalid authentication tag byte length: expected ${AppConstants.authenticationTagByteLength}, received ${arguments.authenticationTag.length}'
      );
    }

    final metadataJsonString = jsonEncode(arguments.authenticatedMetadata.toJson());
    final metadataBytes = Uint8List.fromList(utf8.encode(metadataJsonString));

    final wrappedDekByteLength = arguments.wrappedDek.length;
    final metadataByteLength = metadataBytes.length;
    final payloadByteLength = arguments.encryptedPayload.length;

    final totalContainerByteLength = AppConstants.fixedHeaderByteLength +
        wrappedDekByteLength +
        metadataByteLength +
        payloadByteLength +
        AppConstants.authenticationTagByteLength;

    final containerBuffer = Uint8List(totalContainerByteLength);
    final byteData = ByteData.sublistView(containerBuffer);

    containerBuffer.setRange(0, 8, AppConstants.containerMagicBytes);
    byteData.setUint16(8, formatVersion, Endian.big);
    byteData.setUint16(10, algorithmIdentifier, Endian.big);

    containerBuffer.setRange(12, 28, arguments.keyIdentifier);
    containerBuffer.setRange(28, 40, arguments.nonce);

    byteData.setUint32(40, wrappedDekByteLength, Endian.big);
    byteData.setUint64(44, arguments.originalFileSize, Endian.big);
    byteData.setUint32(52, metadataByteLength, Endian.big);
    byteData.setUint64(56, payloadByteLength, Endian.big);

    int currentWriteOffset = AppConstants.fixedHeaderByteLength;

    containerBuffer.setRange(
      currentWriteOffset,
      currentWriteOffset + wrappedDekByteLength,
      arguments.wrappedDek,
    );
    currentWriteOffset += wrappedDekByteLength;

    containerBuffer.setRange(
      currentWriteOffset,
      currentWriteOffset + metadataByteLength,
      metadataBytes,
    );
    currentWriteOffset += metadataByteLength;

    containerBuffer.setRange(
      currentWriteOffset,
      currentWriteOffset + payloadByteLength,
      arguments.encryptedPayload,
    );
    currentWriteOffset += payloadByteLength;

    containerBuffer.setRange(
      currentWriteOffset,
      currentWriteOffset + AppConstants.authenticationTagByteLength,
      arguments.authenticationTag,
    );

    return containerBuffer;
  }

  static ParsedExamContainerDto decode(Uint8List containerBuffer) {
    final minimumRequiredLength = AppConstants.fixedHeaderByteLength +
        AppConstants.authenticationTagByteLength;

    if (containerBuffer.length < minimumRequiredLength) {
      throw FormatException(
        'Buffer is too small to be a valid container: minimum size is $minimumRequiredLength bytes'
      );
    }

    final magicBytesCandidate = containerBuffer.sublist(0, 8);
    if (!areByteArraysEqual(magicBytesCandidate, AppConstants.containerMagicBytes)) {
      throw const FormatException('Invalid magic bytes in container header');
    }

    final byteData = ByteData.sublistView(containerBuffer);

    final formatVersion = byteData.getUint16(8, Endian.big);
    if (formatVersion != AppConstants.currentFormatVersion) {
      throw FormatException('Unsupported container format version: $formatVersion');
    }

    final algorithmIdentifier = byteData.getUint16(10, Endian.big);
    if (algorithmIdentifier != AppConstants.algorithmAes256Gcm) {
      throw FormatException('Unsupported algorithm identifier: $algorithmIdentifier');
    }

    final keyIdentifier = containerBuffer.sublist(12, 28);
    final nonce = containerBuffer.sublist(28, 40);

    final wrappedDekByteLength = byteData.getUint32(40, Endian.big);
    final originalFileSize = byteData.getUint64(44, Endian.big);
    final metadataByteLength = byteData.getUint32(52, Endian.big);
    final payloadByteLength = byteData.getUint64(56, Endian.big);

    final expectedTotalByteLength = AppConstants.fixedHeaderByteLength +
        wrappedDekByteLength +
        metadataByteLength +
        payloadByteLength +
        AppConstants.authenticationTagByteLength;

    if (containerBuffer.length != expectedTotalByteLength) {
      throw FormatException(
        'Container length mismatch: buffer length ${containerBuffer.length} does not equal calculated length $expectedTotalByteLength'
      );
    }

    int currentReadOffset = AppConstants.fixedHeaderByteLength;

    final wrappedDek = containerBuffer.sublist(
      currentReadOffset,
      currentReadOffset + wrappedDekByteLength,
    );
    currentReadOffset += wrappedDekByteLength;

    final metadataBytes = containerBuffer.sublist(
      currentReadOffset,
      currentReadOffset + metadataByteLength,
    );
    currentReadOffset += metadataByteLength;

    final payloadEndOffset = currentReadOffset + payloadByteLength;
    final encryptedPayload = containerBuffer.sublist(currentReadOffset, payloadEndOffset);
    currentReadOffset = payloadEndOffset;

    final authenticationTag = containerBuffer.sublist(
      currentReadOffset,
      currentReadOffset + AppConstants.authenticationTagByteLength,
    );

    final metadataString = utf8.decode(metadataBytes);
    final metadataJson = jsonDecode(metadataString) as Map<String, dynamic>;
    final authenticatedMetadata = AuthenticatedMetadataDto.fromJson(metadataJson);

    final header = ContainerHeaderDto(
      formatVersion: formatVersion,
      algorithmIdentifier: algorithmIdentifier,
      keyIdentifier: keyIdentifier,
      nonce: nonce,
      originalFileSize: originalFileSize,
      wrappedDek: wrappedDek,
      authenticatedMetadataRaw: metadataBytes,
      authenticatedMetadata: authenticatedMetadata,
      payloadLength: payloadByteLength,
    );

    return ParsedExamContainerDto(
      header: header,
      encryptedPayload: encryptedPayload,
      authenticationTag: authenticationTag,
    );
  }
}
