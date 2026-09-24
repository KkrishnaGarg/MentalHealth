import { LinkButton } from "@/components/ui/Button";
import { SUPPORT } from "@/lib/constants";

export function SupportLinks() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <LinkButton href={SUPPORT.counsellingHref} variant="secondary" external>
        {SUPPORT.counsellingLabel}
      </LinkButton>
      <LinkButton href={SUPPORT.helplineHref} variant="secondary">
        {SUPPORT.helplineLabel}: {SUPPORT.helplineNumber}
      </LinkButton>
    </div>
  );
}
