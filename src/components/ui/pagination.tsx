import Link from 'next/link';
export function Pagination({
  total,
  page,
  pageSize,
  href,
}: {
  total: number;
  page: number;
  pageSize: number;
  href: (page: number) => string;
}) {
  return (
    <nav className="table-footer" aria-label="Pagination">
      <span>
        {total} results · Page {page}
      </span>
      <div>
        {page > 1 && (
          <Link className="text-link" href={href(page - 1)}>
            ← Previous{' '}
          </Link>
        )}
        {page * pageSize < total && (
          <Link className="text-link" href={href(page + 1)}>
            {' '}
            Next →
          </Link>
        )}
      </div>
    </nav>
  );
}
