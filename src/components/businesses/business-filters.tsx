import { TextField, SelectField } from '@/components/ui/form-fields';
import { Button } from '@/components/ui/button';
import { businessStatuses } from '@/modules/tenants/constants';
export function BusinessFilters({ search, status }: { search: string; status: string }) {
  const options = [
    { value: '', label: 'All statuses' },
    ...businessStatuses.map((value) => ({
      value,
      label: value.toLowerCase().replaceAll('_', ' '),
    })),
  ];
  return (
    <form className="business-filters" action="/businesses">
      <TextField
        name="q"
        label="Search businesses"
        defaultValue={search}
        placeholder="Search by name…"
        maxLength={100}
      />
      <SelectField name="status" label="Status" defaultValue={status} options={options} />
      <Button type="submit" variant="secondary">
        Apply filters
      </Button>
    </form>
  );
}
