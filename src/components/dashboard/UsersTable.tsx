import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronRight, Users as UsersIcon } from "lucide-react";
import { fmtCents, fmtViews } from "@/lib/clip-vault-data";
import type { Id } from "@/convex/_generated/dataModel";
import { UserDetail } from "@/components/dashboard/UserDetail";
import { useClipVault } from "@/lib/clip-vault-store";

function joinedLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Every user on the platform with the accounts they connected and what their
 * clips earned. Rows expand to the account level, because "3 accounts" is not
 * actionable on its own — the point is seeing which handles are verified and
 * how much reach each one brings.
 */
export function UsersTable() {
  const { adminUsers } = useClipVault();
  /* Clicking a row opens the full profile — accounts, reach, latest uploads and
     the averages — rather than only expanding an inline list of handles. */
  const [detailId, setDetailId] = useState<Id<"users"> | null>(null);

  const totalViews = adminUsers.reduce((sum, u) => sum + u.views, 0);
  const totalEarned = adminUsers.reduce((sum, u) => sum + u.availableCents, 0);
  const totalAccounts = adminUsers.reduce((sum, u) => sum + u.accounts.length, 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel rounded-2xl p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
            <UsersIcon className="h-4 w-4" />
          </span>
          <h2 className="text-[15px] font-bold tracking-tight">Users</h2>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold">
          <span className="rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-muted-foreground dark:border-white/10 dark:bg-white/[0.05]">
            {adminUsers.length} users · {totalAccounts} accounts
          </span>
          <span className="rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-muted-foreground dark:border-white/10 dark:bg-white/[0.05]">
            {fmtViews(totalViews)} views
          </span>
          <span className="rounded-full border border-neon/30 bg-neon/10 px-2.5 py-1 text-neon">
            {fmtCents(totalEarned)} in creator balances
          </span>
        </div>
      </div>

      {adminUsers.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-black/12 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/15">
          No users yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Accounts</TableHead>
                <TableHead className="text-right">Clips</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminUsers.map((user) => {
                return (
                  <>
                    <TableRow
                      key={user.userId}
                      onClick={() =>
                        setDetailId(user.userId as Id<"users">)
                      }
                      title="Open this creator's profile"
                      className="cursor-pointer transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    >
                      <TableCell>
                        <span className="block text-muted-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          {user.image ? (
                            <img
                              src={user.image}
                              alt=""
                              className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                            />
                          ) : (
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#A855F7] to-[#5B0FA6] text-[10px] font-bold text-white">
                              {(user.name || user.email)
                                .slice(0, 1)
                                .toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold">
                              {user.name}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            user.role === "admin"
                              ? "rounded-full border border-brand/35 bg-brand/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-brand"
                              : "rounded-full border border-black/10 px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground dark:border-white/10"
                          }
                        >
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground">
                        {joinedLabel(user.joined)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px]">
                        {user.accounts.length}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px]">
                        {user.clips}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px]">
                        {fmtViews(user.views)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px] font-bold text-neon">
                        {fmtCents(user.availableCents)}
                        {user.pendingCents > 0 ? (
                          <span className="block text-[10.5px] font-medium text-amber-500">
                            {fmtCents(user.pendingCents)} pending
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>

                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AnimatePresence>
        {detailId && (
          <UserDetail userId={detailId} onClose={() => setDetailId(null)} />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
