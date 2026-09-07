import { signOut } from '@/modules/auth/actions';
import { Button } from '@/components/ui/button';
export function SignOutForm() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="secondary">
        Sign out
      </Button>
    </form>
  );
}
