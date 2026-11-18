import { useState } from 'react';
import { Navbar, type NavigationTab } from './components/Navbar.tsx';
import { OverviewView } from './components/OverviewView.tsx';
import { ExamsView } from './components/ExamsView.tsx';
import { ClassesView } from './components/ClassesView.tsx';
import { SubmissionsView } from './components/SubmissionsView.tsx';
import { AuditLogsView } from './components/AuditLogsView.tsx';

export function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');

  return (
    <div className="min-h-screen bg-[#000000] text-[#ededed]">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewView onNavigateToTab={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'exams' && <ExamsView />}
        {activeTab === 'classes' && <ClassesView />}
        {activeTab === 'submissions' && <SubmissionsView />}
        {activeTab === 'audit' && <AuditLogsView />}
      </main>
    </div>
  );
}

export default App;
