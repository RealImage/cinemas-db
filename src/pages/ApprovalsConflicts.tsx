import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApprovalsSummary, type DashboardCount } from "@/hooks/api/approvals";
import { QueryState } from "@/components/ui/query-state";

interface DashboardItem {
  label: string;
  count: number;
  path?: string;
}

/** Rows that link somewhere. */
const PATHS: Record<string, string> = {
  "Company Claims": "/approvals-conflicts/company-claims",
  "Partners": "/approvals-conflicts/partners",
  "Theatre Deletions": "/approvals-conflicts/theatre-deletions",
  "Third-party Theatre Updates: FLM": "/theatres/flm-feeds",
  "WireTAPs": "/qube-appliances/wiretap",
};

const withPaths = (items: DashboardCount[]): DashboardItem[] =>
  items.map((item) => ({ ...item, path: PATHS[item.label] }));

const ROW = "flex items-center justify-between py-2 px-3 rounded-md transition-colors";

/** A summary row; rows with a destination are router links, so they're focusable and open with Enter. */
const Row = ({ item }: { item: DashboardItem }) => {
  const content = (
    <>
      <span className="text-sm">{item.label}</span>
      <Badge
        variant={item.count > 0 ? "default" : "secondary"}
        className="min-w-[3rem] justify-center"
      >
        {item.count.toLocaleString()}
      </Badge>
    </>
  );
  return item.path ? (
    <Link
      to={item.path}
      className={`${ROW} hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
    >
      {content}
    </Link>
  ) : (
    <div className={ROW}>{content}</div>
  );
};

const Section = ({
  title,
  items,
  delay,
}: {
  title: string;
  items: DashboardItem[];
  delay: number;
}) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {items.map((item) => (
            <Row key={item.label} item={item} />
          ))}
        </CardContent>
      </Card>
    </motion.div>
);

const ApprovalsConflicts = () => {
  const summaryQuery = useApprovalsSummary();
  return (
    <QueryState query={summaryQuery} label="approvals and conflicts">
      {(summary) => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Section title="Approvals Dashboard" items={withPaths(summary.approvals)} delay={0} />
            <Section title="Third-party Updates" items={withPaths(summary.thirdParty)} delay={0.2} />
          </div>
          <Section title="Conflicts Dashboard" items={withPaths(summary.conflicts)} delay={0.1} />
        </div>
      )}
    </QueryState>
  );
};

export default ApprovalsConflicts;
