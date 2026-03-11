import { useParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';

export default function CategoryPage() {
  const { id } = useParams();
  
  const { data: threads, isLoading } = useQuery({
    queryKey: ['threads', id],
    queryFn: () => fetch(`/api/threads?categoryId=${id}`).then(res => res.json())
  });

  if (isLoading) return <div>Loading threads...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-indigo-400 hover:text-indigo-300 mb-2 inline-block">&larr; Back to Forums</Link>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Category Threads</h1>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium">New Thread</button>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
        {threads?.map((thread: any) => (
          <div key={thread.id} className="p-4 hover:bg-zinc-800/50 transition-colors flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-zinc-100 hover:text-indigo-400 cursor-pointer">{thread.title}</h3>
              <p className="text-sm text-zinc-500 mt-1">Started by <span className="text-zinc-300">{thread.author}</span> • {new Date(thread.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-4 text-sm text-zinc-500 text-right">
              <div>
                <div className="font-medium text-zinc-300">{thread.replies}</div>
                <div>Replies</div>
              </div>
              <div>
                <div className="font-medium text-zinc-300">{thread.views}</div>
                <div>Views</div>
              </div>
            </div>
          </div>
        ))}
        {threads?.length === 0 && (
          <div className="p-8 text-center text-zinc-500">No threads in this category yet.</div>
        )}
      </div>
    </div>
  );
}
