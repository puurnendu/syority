'use client';

/**
 * M7.6G.1 — Installation Wizard
 *
 * Multi-step first-run setup. Accessible without auth.
 * Steps: Welcome → System Check → Admin User → Organization → Seed Pack → Install → Complete
 */

import { useState, useEffect, useCallback } from 'react';

type Step = 'welcome' | 'check' | 'admin' | 'org' | 'seed' | 'install' | 'complete';

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'welcome', label: 'Welcome', icon: '👋' },
  { key: 'check', label: 'System Check', icon: '🔍' },
  { key: 'admin', label: 'Admin User', icon: '👤' },
  { key: 'org', label: 'Organization', icon: '🏢' },
  { key: 'seed', label: 'Seed Pack', icon: '🌱' },
  { key: 'install', label: 'Install', icon: '⚡' },
  { key: 'complete', label: 'Complete', icon: '✅' },
];

export default function InstallPage() {
  const [step, setStep] = useState<Step>('welcome');
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installLog, setInstallLog] = useState<string[]>([]);

  // Form state
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [orgName, setOrgName] = useState('Syority Technologies');
  const [orgSlug, setOrgSlug] = useState('syority-platform');
  const [seedPackSlug, setSeedPackSlug] = useState('none');

  // Check installation status on load
  useEffect(() => {
    fetch('/api/install')
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        if (data.isInstalled) setStep('complete');
      });
  }, []);

  const runInstall = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminName,
          adminEmail,
          adminPassword,
          orgName,
          orgSlug,
          seedPackSlug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Installation failed');
      setInstallLog(data.log);
      setStep('complete');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adminName, adminEmail, adminPassword, orgName, orgSlug, seedPackSlug]);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="w-full max-w-2xl mx-4">
      {/* Progress */}
      <div className="flex items-center justify-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition ${
                i < stepIndex ? 'bg-green-500 text-white' :
                i === stepIndex ? 'bg-indigo-500 text-white' :
                'bg-white/10 text-white/40'
              }`}
            >
              {i < stepIndex ? '✓' : s.icon}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 ${i < stepIndex ? 'bg-green-500' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
        {/* Welcome */}
        {step === 'welcome' && (
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-white">Welcome to Aurianoa OS</h1>
            <p className="text-indigo-200">Let&apos;s set up your platform in a few simple steps.</p>
            <button
              onClick={() => setStep('check')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition mt-4"
            >
              Begin Setup →
            </button>
          </div>
        )}

        {/* System Check */}
        {step === 'check' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">System Check</h2>
            <p className="text-sm text-indigo-200">Verifying infrastructure components.</p>
            {status?.infra ? (
              <div className="space-y-2">
                {status.infra.map((check: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                    <span className="text-sm text-white">{check.component}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      check.status === 'ok' ? 'bg-green-500/20 text-green-300' :
                      check.status === 'warning' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>
                      {check.message}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/50 animate-pulse">Checking...</div>
            )}
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep('welcome')} className="px-4 py-2 text-white/60 text-sm hover:text-white">← Back</button>
              <button
                onClick={() => setStep('admin')}
                disabled={!status?.checks?.database}
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Admin User */}
        {step === 'admin' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Platform Administrator</h2>
            <p className="text-sm text-indigo-200">Create the super admin account.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-indigo-300 mb-1">Full Name</label>
                <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="John Doe"
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:border-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-indigo-300 mb-1">Email</label>
                <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@company.com" type="email"
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:border-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-indigo-300 mb-1">Password (min 8 characters)</label>
                <input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} type="password"
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:border-indigo-400 outline-none" />
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep('check')} className="px-4 py-2 text-white/60 text-sm hover:text-white">← Back</button>
              <button
                onClick={() => setStep('org')}
                disabled={!adminName || !adminEmail || adminPassword.length < 8}
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Organization */}
        {step === 'org' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Platform Organization</h2>
            <p className="text-sm text-indigo-200">Configure the platform organization.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-indigo-300 mb-1">Organization Name</label>
                <input value={orgName} onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:border-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-indigo-300 mb-1">Slug</label>
                <input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-lg text-white text-sm font-mono placeholder:text-white/30 focus:border-indigo-400 outline-none" />
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep('admin')} className="px-4 py-2 text-white/60 text-sm hover:text-white">← Back</button>
              <button
                onClick={() => setStep('seed')}
                disabled={!orgName || !orgSlug}
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Seed Pack */}
        {step === 'seed' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Initial Data</h2>
            <p className="text-sm text-indigo-200">Optionally provision a demo organization.</p>
            <div className="space-y-2">
              {[
                { slug: 'none', label: 'No demo data', desc: 'Start with a clean platform' },
                { slug: 'refinery_demo', label: '🏭 Refinery Demo', desc: 'Full turnaround with CDU/VDU/NHT/FCC, 8 users, 50 workpacks' },
                { slug: 'petrochemical_demo', label: '🏭 Petrochemical Demo', desc: 'Ethylene cracker + polymer units' },
                { slug: 'contractor_demo', label: '🔧 Contractor Company', desc: 'Engineering contractor setup' },
                { slug: 'training', label: '📚 Training Environment', desc: 'Sample exercises and guided workflows' },
              ].map((pack) => (
                <label
                  key={pack.slug}
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition ${
                    seedPackSlug === pack.slug
                      ? 'border-indigo-400 bg-indigo-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="seedPack"
                    checked={seedPackSlug === pack.slug}
                    onChange={() => setSeedPackSlug(pack.slug)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{pack.label}</p>
                    <p className="text-xs text-indigo-300">{pack.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep('org')} className="px-4 py-2 text-white/60 text-sm hover:text-white">← Back</button>
              <button
                onClick={() => setStep('install')}
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition"
              >
                Review & Install →
              </button>
            </div>
          </div>
        )}

        {/* Review & Install */}
        {step === 'install' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Review & Install</h2>
            <div className="space-y-2">
              <div className="bg-white/5 rounded-lg p-3 flex justify-between">
                <span className="text-xs text-indigo-300">Admin</span>
                <span className="text-sm text-white">{adminName} ({adminEmail})</span>
              </div>
              <div className="bg-white/5 rounded-lg p-3 flex justify-between">
                <span className="text-xs text-indigo-300">Organization</span>
                <span className="text-sm text-white">{orgName}</span>
              </div>
              <div className="bg-white/5 rounded-lg p-3 flex justify-between">
                <span className="text-xs text-indigo-300">Seed Pack</span>
                <span className="text-sm text-white">{seedPackSlug === 'none' ? 'None' : seedPackSlug}</span>
              </div>
            </div>
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">{error}</div>
            )}
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep('seed')} className="px-4 py-2 text-white/60 text-sm hover:text-white">← Back</button>
              <button
                onClick={runInstall}
                disabled={loading}
                className="px-6 py-2.5 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700 disabled:opacity-50 transition"
              >
                {loading ? '⏳ Installing...' : '⚡ Install Now'}
              </button>
            </div>
          </div>
        )}

        {/* Complete */}
        {step === 'complete' && (
          <div className="text-center space-y-4">
            <span className="text-5xl">🎉</span>
            <h2 className="text-2xl font-bold text-white">Installation Complete</h2>
            <p className="text-sm text-indigo-200">Aurianoa OS is ready to use.</p>
            {installLog.length > 0 && (
              <div className="bg-white/5 rounded-lg p-4 text-left">
                {installLog.map((line, i) => (
                  <p key={i} className="text-xs text-indigo-300 font-mono">{line}</p>
                ))}
              </div>
            )}
            <a
              href="/auth/login"
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition mt-4"
            >
              Go to Login →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
