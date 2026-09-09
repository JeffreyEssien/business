import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-fields';
import { applicationStatusOptions } from '@/modules/applications/options';

export function ApplicationFilters({ search, status }: { search: string; status: string }) {
  return (
    <form className="business-filters" method="get">
      <TextField
        name="q"
        label="Search applications"
        defaultValue={search}
        maxLength={100}
        placeholder="Name, email, or reference"
      />
      <SelectField
        name="status"
        label="Application status"
        defaultValue={status}
        options={applicationStatusOptions}
      />
      <Button type="submit" variant="secondary">
        Apply filters
      </Button>
    </form>
  );
}
