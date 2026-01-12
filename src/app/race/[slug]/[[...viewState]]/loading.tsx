export default function ViewerLoading() {
  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-coral border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400">Loading viewer...</p>
      </div>
    </div>
  );
}
