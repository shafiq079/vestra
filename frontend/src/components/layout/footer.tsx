import { Link } from 'react-router-dom';
import { Camera, Music2, Users } from 'lucide-react';
import { brand } from '@/config/brand';
import { footerLinks } from '@/config/navigation';

export function Footer() {
  return (
    <footer className="bg-foreground text-background mt-auto">
      <div className="container-vestra py-12 lg:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link
              to="/"
              className="font-display text-2xl font-bold"
            >
              {brand.name}
            </Link>

            <p className="mt-3 max-w-xs text-sm text-background/70">
              {brand.description}
            </p>

            <div className="mt-4 flex gap-3">
              <a
                href={brand.social.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="hover:opacity-70"
              >
                <Camera className="h-5 w-5" />
              </a>

              <a
                href={brand.social.tiktok}
                target="_blank"
                rel="noreferrer"
                aria-label="TikTok"
                className="hover:opacity-70"
              >
                <Music2 className="h-5 w-5" />
              </a>

              <a
                href={brand.social.facebook}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="hover:opacity-70"
              >
                <Users className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Customer Care */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">
              Customer Care
            </h3>

            <ul className="space-y-2">
              {footerLinks.customerCare.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-background/70 transition-colors hover:text-background"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">
              Company
            </h3>

            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-background/70 transition-colors hover:text-background"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Technology */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">
              Technology
            </h3>

            <ul className="space-y-2">
              {footerLinks.technology.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-background/70 transition-colors hover:text-background"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="col-span-2 min-w-0 md:col-span-1">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">
              Newsletter
            </h3>

            <p className="mb-3 text-sm text-background/70">
              Subscribe for early access to new collections and exclusive
              offers.
            </p>

            <form
              className="flex w-full min-w-0 flex-col gap-2 sm:flex-row"
              onSubmit={(event) => event.preventDefault()}
            >
              <input
                type="email"
                placeholder="Email address"
                className="w-full min-w-0 rounded-md border border-background/20 bg-background/10 px-3 py-2 text-sm placeholder:text-background/50 focus:border-background/40 focus:outline-none sm:flex-1"
              />

              <button
                type="submit"
                className="w-full shrink-0 rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background/90 sm:w-auto"
              >
                Join
              </button>
            </form>
          </div>
        </div>

        {/* Bottom footer */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-background/20 pt-6 sm:flex-row">
          <p className="text-center text-xs text-background/60 sm:text-left">
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </p>

          <p className="max-w-full break-words text-center text-xs text-background/60 sm:text-right">
            {brand.address} · {brand.email}
          </p>
        </div>
      </div>
    </footer>
  );
}