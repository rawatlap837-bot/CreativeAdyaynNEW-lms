export function Skeleton({ className = "", circle = false }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "block animate-pulse bg-violet-100/80",
        circle ? "rounded-full" : "rounded-md",
        className,
      ].join(" ")}
    />
  );
}

export function RingSkeleton({ size = 56 }) {
  return (
    <div
      className="rounded-full animate-pulse bg-violet-200/60"
      style={{ height: size, width: size }}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton circle className="h-9 w-9" />
      </div>
      <Skeleton className="mt-4 h-7 w-20" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 4 }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <Skeleton className="h-4 w-full max-w-[140px]" />
        </td>
      ))}
    </tr>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton circle className="h-9 w-9 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 3, as: SkeletonComponent, cols = 3 }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
}
