import { motion } from "framer-motion";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
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
 * section's own page. Cards use the shared glass panel treatment (lift, violet
 * bloom, hover specular band) and stagger in on mount.
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
            className="panel-fx glass-panel glass-sheen group relative block h-full overflow-hidden rounded-2xl p-5"
          >
            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="glass-chip inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#C9AEFF] transition-transform duration-300 group-hover:scale-105">
                <card.icon className="h-4 w-4" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#C9AEFF]" />
            </div>

            <p className="relative z-10 mt-4 font-mono text-[22px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-foreground">
              {card.value}
            </p>
            <p className="relative z-10 mt-2 text-[13px] font-semibold tracking-tight">
              {card.label}
            </p>
            <p className="relative z-10 mt-1 text-[11.5px] leading-snug text-muted-foreground">
              {card.hint}
            </p>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
