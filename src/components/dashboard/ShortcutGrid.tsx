import { motion } from "framer-motion";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router";

export type Shortcut = {
  /** Dashboard route this card links to. */
  to: string;
  icon: LucideIcon;
  /** Big mono figure — a real number from the store. */
  value: string;
  label: string;
  hint: string;
};

/**
 * Overview page shortcut cards — one per sidebar section, each linking to that
 * section's own page. Cards use the shared panel hover treatment (lift, violet
 * bloom, sheen sweep) and stagger in on mount.
 */
export function ShortcutGrid({ cards }: { cards: Shortcut[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.to}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.06 * index,
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Link
            to={card.to}
            className="panel-fx group block h-full rounded-2xl border border-black/8 dark:border-white/10 bg-card/70 p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">
                <card.icon className="h-4 w-4" />
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5" />
            </div>
            <p className="mt-3 font-mono text-xl font-extrabold tracking-tight text-foreground">
              {card.value}
            </p>
            <p className="mt-1 text-[13px] font-semibold">{card.label}</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {card.hint}
            </p>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
