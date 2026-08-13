import { Badge } from "@/components/ui/Badge";
import { SOURCE_STATUS_LABELS, type SourceStatus } from "@/types/domain";

const STATUS_TONE: Record<SourceStatus, "neutral" | "success" | "warning" | "danger"> = {
  candidate: "neutral",
  active: "success",
  paused: "warning",
  rejected: "danger",
};

interface SourceStatusBadgeProps {
  status: SourceStatus;
}

export function SourceStatusBadge({ status }: SourceStatusBadgeProps) {
  return <Badge tone={STATUS_TONE[status]}>{SOURCE_STATUS_LABELS[status]}</Badge>;
}
