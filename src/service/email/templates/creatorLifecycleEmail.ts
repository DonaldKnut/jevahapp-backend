import { renderEmailTemplate } from "../../../emails/render";

export function generateCreatorLifecycleEmail(input: {
  title: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
  reason?: string;
}): string {
  return renderEmailTemplate("creator-lifecycle", input);
}
