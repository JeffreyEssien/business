'use client';
import { useState } from 'react';
import { FormSection } from '@/components/ui/form-layout';
import { portfolioSectionLanguage } from '@/modules/portfolio/sections';
import type { PortfolioTemplate, SiteKind } from '@/modules/portfolio/types';
import styles from './portfolio-setup.module.css';

const siteKindChoices: Array<{ value: SiteKind; name: string; description: string }> = [
  {
    value: 'STORE',
    name: 'Online store',
    description: 'Products, cart, checkout, and orders.',
  },
  {
    value: 'PORTFOLIO',
    name: 'Portfolio',
    description: 'A personal or studio website for projects, experience, and contact. Free.',
  },
];

/** Controlled site-kind choice. The hidden radio value is what the server validates. */
export function SiteKindFields({
  value,
  onChange,
}: {
  value: SiteKind;
  onChange: (value: SiteKind) => void;
}) {
  return (
    <FormSection
      title="00 · Website type"
      description="This is fixed once the business is created, so choose what the owner needs."
    >
      <div className={styles.kindGrid} role="radiogroup" aria-label="Website type">
        {siteKindChoices.map((choice) => (
          <label
            key={choice.value}
            className={`${styles.card} ${value === choice.value ? styles.selected : ''}`}
          >
            <input
              type="radio"
              name="siteKind"
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
            />
            <span>
              <strong>{choice.name}</strong>
              <small>{choice.description}</small>
            </span>
          </label>
        ))}
      </div>
    </FormSection>
  );
}

function Palette({ tokens }: { tokens: PortfolioTemplate['defaultTokens'] }) {
  const colours = [tokens.background, tokens.primary, tokens.accent, tokens.text].filter(
    (colour): colour is string => typeof colour === 'string' && /^#[0-9a-f]{6}$/i.test(colour),
  );
  return (
    <span className={styles.palette} aria-hidden="true">
      {colours.map((colour, index) => (
        <i key={`${colour}-${index}`} style={{ background: colour }} />
      ))}
    </span>
  );
}

/** Template gallery for portfolio provisioning. Keys are re-validated by the database. */
export function PortfolioSetupFields({
  templates,
  defaultTemplate,
}: {
  templates: PortfolioTemplate[];
  defaultTemplate?: string;
}) {
  const [selected, setSelected] = useState(
    templates.some((template) => template.key === defaultTemplate)
      ? defaultTemplate
      : templates[0]?.key,
  );
  if (!templates.length) {
    return (
      <FormSection title="03 · Portfolio template">
        <p className={styles.empty} role="status">
          No portfolio templates are switched on. Activate at least one template to create a
          portfolio.
        </p>
      </FormSection>
    );
  }
  return (
    <FormSection
      title="03 · Portfolio template"
      description="Pick a starting point. The owner can change colours, style, and section order later. Portfolios use the free Portfolio plan."
    >
      <div className={styles.templateGrid} role="radiogroup" aria-label="Portfolio template">
        {templates.map((template) => (
          <label
            key={template.key}
            className={`${styles.card} ${styles.templateCard} ${
              selected === template.key ? styles.selected : ''
            }`}
          >
            <input
              type="radio"
              name="template"
              value={template.key}
              checked={selected === template.key}
              onChange={() => setSelected(template.key)}
            />
            <span>
              <Palette tokens={template.defaultTokens} />
              <strong>{template.name}</strong>
              <em>{template.audience}</em>
              <small>{template.description}</small>
              <small className={styles.sections}>
                {template.sectionTypes
                  .map((type) => portfolioSectionLanguage[type]?.name ?? type)
                  .join(' · ')}
              </small>
            </span>
          </label>
        ))}
      </div>
    </FormSection>
  );
}
