'use client';
import { useActionState } from 'react';
import { createBusiness } from '@/modules/tenants/actions';
import { Button } from '@/components/ui/button';
import { FormStack, FormActions, FormError } from '@/components/ui/form-layout';
import { Panel } from '@/components/ui/panel';
import { BusinessDetailsFields, OwnerFields, InitialSetupFields } from './business-fields';
import styles from './create-business-form.module.css';

/** This component only coordinates form state. Validation and writes stay on the server. */
export function CreateBusinessForm() {
  const [state, submitAction, isPending] = useActionState(createBusiness, { error: '' });
  return (
    <Panel className={styles.container}>
      <FormStack
        action={submitAction}
        className={styles.form}
        aria-label="Create business"
        aria-busy={isPending}
      >
        <BusinessDetailsFields values={state.values} />
        <OwnerFields values={state.values} />
        <InitialSetupFields values={state.values} />
        <FormError message={state.error} />
        <FormActions note="Your business starts as a draft. Nothing is published.">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating business…' : 'Create business →'}
          </Button>
        </FormActions>
      </FormStack>
    </Panel>
  );
}
