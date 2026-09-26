import { PlatformChip, StatusBadge } from "@/components/ClipticUI";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown, Users as UsersIcon } from "lucide-react";
import { fmtFull, fmtMoney, fmtViews, type AdminUser } from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";

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
  const { adminUsers } = useCliptic();
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalViews = adminUsers.reduce((sum, u) => sum + u.views, 0);
  const totalEarned = adminUsers.reduce((sum, u) => sum + u.earned, 0);
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
            {fmtMoney(totalEarned)} earned
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
                <TableHead className="text-right">Earned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminUsers.map((user) => {
                const open = expanded === user.userId;
                return (
                  <>
                    <TableRow
                      key={user.userId}
                      onClick={() =>
                        setExpanded(open ? null : user.userId)
                      }
                      className="cursor-pointer transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    >
                      <TableCell>
                        <motion.span
                          animate={{ rotate: open ? 180 : 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="block text-muted-foreground"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </motion.span>
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
                        {fmtMoney(user.earned)}
                      </TableCell>
                    </TableRow>

                    {open && (
                      <TableRow key={`${user.userId}-accounts`}>
                        <TableCell colSpan={8} className="bg-black/[0.02] px-4 py-3 dark:bg-white/[0.02]">
                          {user.accounts.length === 0 ? (
                            <p className="text-[12px] text-muted-foreground">
                              No accounts connected yet.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {user.accounts.map((account) => (
                                <li
                                  key={account.id}
                                  className="glass-chip flex flex-wrap items-center gap-3 rounded-lg px-3 py-2"
                                >
                                  <PlatformChip platform={account.platform} size="sm" />
                                  <span className="text-[13px] font-semibold">
                                    @{account.handle}
                                  </span>
                                  <StatusBadge status={account.status} />
                                  <span className="text-[11px] text-muted-foreground">
                                    {account.followers != null
                                      ? `${fmtViews(account.followers)} followers`
                                      : null}
                                    {account.followers != null &&
                                    account.posts != null
                                      ? " · "
                                      : null}
                                    {account.posts != null
                                      ? `${fmtFull(account.posts)} posts`
                                      : null}
                                    {account.followers == null &&
                                    account.posts == null
                                      ? "Reach not published by this platform"
                                      : null}
                                  </span>
                                  {account.connectedAt ? (
                                    <span className="ml-auto text-[11px] text-muted-foreground">
                                      verified{" "}
                                      {new Date(
                                        account.connectedAt,
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </motion.section>
  );
}
