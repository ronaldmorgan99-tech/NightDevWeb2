import React from 'react';
import { Link, useLocation } from 'react-router';
import { ShieldCheck, Lock, FileText, LifeBuoy } from 'lucide-react';

type InfoContent = {
  title: string;
  eyebrow: string;
  icon: React.ComponentType<{ className?: string }>;
  body: string[];
  cta?: { label: string; to: string };
};

const INFO_CONTENT: Record<string, InfoContent> = {
  '/rules': {
    title: 'Community Rules',
    eyebrow: 'Protocol // Conduct',
    icon: ShieldCheck,
    body: [
      'Respect other members, moderators, and staff across forums, DMs, Discord, and game servers.',
      'Keep posts and messages relevant to the channel or forum topic, and do not spam, harass, impersonate, or share malicious links.',
      'Report problems through support instead of escalating conflicts in public threads.'
    ],
    cta: { label: 'Open Support', to: '/support' }
  },
  '/privacy': {
    title: 'Privacy Policy',
    eyebrow: 'Data // Privacy',
    icon: Lock,
    body: [
      'NightRespawn uses account, profile, message, and support-ticket data to operate the community platform and keep members connected.',
      'Do not post secrets, passwords, payment details, or private personal information in public areas or direct messages.',
      'Use account settings and support if you need help updating or removing information tied to your account.'
    ],
    cta: { label: 'Account Settings', to: '/settings' }
  },
  '/terms': {
    title: 'Terms of Service',
    eyebrow: 'Access // Terms',
    icon: FileText,
    body: [
      'By using NightRespawn, you agree to follow the community rules and any server-specific instructions from staff.',
      'Content that breaks platform rules may be moderated, removed, or escalated to account restrictions.',
      'Services, servers, and integrations may change over time as the community platform evolves.'
    ],
    cta: { label: 'View Rules', to: '/rules' }
  }
};

export default function InfoPage() {
  const location = useLocation();
  const content = INFO_CONTENT[location.pathname] ?? INFO_CONTENT['/rules'];
  const Icon = content.icon;

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-8">
      <section className="cyber-card p-8 md:p-12 border-neon-cyan/20">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-cyber-black border border-neon-cyan/30 flex items-center justify-center shrink-0">
            <Icon className="w-7 h-7 text-neon-cyan" />
          </div>
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neon-cyan">{content.eyebrow}</p>
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white">{content.title}</h1>
            <div className="space-y-4 text-sm leading-7 text-zinc-400">
              {content.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {content.cta && (
              <Link to={content.cta.to} className="inline-flex items-center gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-neon-cyan hover:bg-neon-cyan hover:text-cyber-black transition-colors">
                <LifeBuoy className="w-4 h-4" />
                {content.cta.label}
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
