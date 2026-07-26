import { SettingsNavItems } from './SettingsNavItems';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-screen-2xl mx-auto">
      {/* Sidebar: sticky below fixed topnav */}
      <aside
        className="
          w-56 flex-shrink-0
          sticky top-14 self-start
          h-[calc(100vh-3.5rem)]
          overflow-y-auto overflow-x-hidden
          bg-[#0D2137]
          border-r border-white/10
          flex flex-col
          hidden lg:flex
          sidebar-scroll
        "
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#1E3A52 transparent' }}
      >
        <div className="px-3 pt-4 pb-2">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-widest px-2 mb-3">
            Settings
          </p>
        </div>
        <nav className="flex-1 px-2 pb-6 overflow-y-auto">
          <SettingsNavItems />
        </nav>
        <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
          <p className="text-xs text-white/20">SYORITY</p>
        </div>
      </aside>

      {/* Content: normal document flow */}
      <main className="flex-1 min-w-0 min-h-screen settings-content">
        <div className="max-w-4xl px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
