import { Link } from 'react-router';

export default function ComingSoonPage() {
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-10 text-center">
      <h1 className="mb-3 text-3xl font-bold tracking-tight text-white">Veo Studio is coming soon</h1>
      <p className="mx-auto mb-8 max-w-xl text-zinc-400">
        We&apos;re still wiring up media generation APIs for this feature. Check back soon for image-to-video
        generation.
      </p>
      <Link
        to="/"
        className="inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        Return to forums
      </Link>
    </div>
  );
}
