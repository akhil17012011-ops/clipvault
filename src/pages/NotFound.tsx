import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col"
    >

      
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="max-w-5xl mx-auto relative px-4">
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center">
              <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-grad">404</h1>
              <p className="text-lg text-muted-foreground">Page not found</p>
              <a
                href="/"
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-black/12 bg-black/[0.03] px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-black/[0.05]"
              >
                Back to CLIPTIC
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
