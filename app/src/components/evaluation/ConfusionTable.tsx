import type { ConfusionMatrix } from "../../types/domain";
import { formatCount } from "../../lib/format";

export function ConfusionTable({ confusion }: { confusion: ConfusionMatrix }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="mb-2 text-left text-mute">Confusion matrix from the loaded result</caption>
        <thead>
          <tr className="text-mute">
            <th className="px-2 py-2 font-medium">Label</th>
            <th className="px-2 py-2 font-medium">Predicted vulnerable</th>
            <th className="px-2 py-2 font-medium">Predicted safe</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-line">
            <th className="px-2 py-2 font-medium">Actual vulnerable</th>
            <td className="px-2 py-2 tabular-nums">{formatCount(confusion.truePositive)}</td>
            <td className="px-2 py-2 tabular-nums">{formatCount(confusion.falseNegative)}</td>
          </tr>
          <tr className="border-t border-line">
            <th className="px-2 py-2 font-medium">Actual safe</th>
            <td className="px-2 py-2 tabular-nums">{formatCount(confusion.falsePositive)}</td>
            <td className="px-2 py-2 tabular-nums">{formatCount(confusion.trueNegative)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
