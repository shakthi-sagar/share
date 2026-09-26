import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { isInternalHref, isModifiedClick, navigate } from "../lib/navigation";

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};

/**
 * An internal link that routes in the app instead of reloading the document. Modified clicks,
 * non-primary buttons, and external destinations keep the browser default so open-in-new-tab and
 * "copy link address" keep working.
 */
export function AppLink({ href, onClick, target, ...rest }: AppLinkProps): React.JSX.Element {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    onClick?.(event);
    if (event.defaultPrevented || target === "_blank" || isModifiedClick(event)) {
      return;
    }
    if (!isInternalHref(href)) {
      return;
    }
    event.preventDefault();
    navigate(href);
  }
  return (
    <a
      {...rest}
      href={href}
      onClick={handleClick}
      {...(target ? { target } : {})}
      {...(target === "_blank" ? { rel: rest.rel ?? "noreferrer" } : {})}
    />
  );
}
