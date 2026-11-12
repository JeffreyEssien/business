'use client';
import { useActionState, useState } from 'react';
import { createBusiness } from '@/modules/tenants/actions';
import { Button } from '@/components/ui/button';
import { FormStack, FormActions, FormError } from '@/components/ui/form-layout';
import { Panel } from '@/components/ui/panel';
import {
  PortfolioSetupFields,
  SiteKindFields,
} from '@/components/portfolio/portfolio-setup-fields';
import type { PortfolioTemplate, SiteKind } from '@/modules/portfolio/types';
import { BusinessDetailsFields, OwnerFields, InitialSetupFields } from './business-fields';
import styles from './create-business-form.module.css';

/** This component only coordinates form state. Validation and writes stay on the server. */
export function CreateBusinessForm({
  portfolioTemplates,
}: {
  portfolioTemplates: PortfolioTemplate[];
}) {
  const [state, submitAction, isPending] = useActionState(createBusiness, { error: '' });
  const [siteKind, setSiteKind] = useState<SiteKind>(state.values?.siteKind ?? 'STORE');
  const isPortfolio = siteKind === 'PORTFOLIO';
  return (
    <Panel className={styles.container}>
      <FormStack
        action={submitAction}
        className={styles.form}
        aria-label="Create business"
        aria-busy={isPending}
      >
        <SiteKindFields value={siteKind} onChange={setSiteKind} />
        <BusinessDetailsFields values={state.values} siteKind={siteKind} />
        <OwnerFields values={state.values} />
        {isPortfolio ? (
          <PortfolioSetupFields
            templates={portfolioTemplates}
            defaultTemplate={state.values?.template}
          />
        ) : (
          <InitialSetupFields values={state.values} />
        )}
        <FormError message={state.error} />
        <FormActions note="The website starts as a draft. Nothing is published.">
          <Button type="submit" disabled={isPending || (isPortfolio && !portfolioTemplates.length)}>
            {isPending ? 'Creating…' : isPortfolio ? 'Create portfolio →' : 'Create business →'}
          </Button>
        </FormActions>
      </FormStack>
    </Panel>
  );
}
