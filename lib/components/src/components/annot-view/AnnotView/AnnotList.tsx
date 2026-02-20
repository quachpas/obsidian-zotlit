import type { AnnotationInfo, TagInfo } from "@obzt/database";
import { useSet } from "ahooks";
import Annotation from "../Annotation";

export interface AnnotListProps {
  annotations: AnnotationInfo[];
  getTags(itemKey: string): TagInfo[];
  selectable?: boolean;
  collapsed: boolean;
}
export default function AnnotList({
  selectable = false,
  collapsed,
  annotations,
  getTags,
}: AnnotListProps) {
  const [selected, { add, remove }] = useSet<string>();
  return (
    <div
      role="list"
      className="@md:grid-cols-2 @md:gap-3 @3xl:grid-cols-4 grid grid-cols-1 gap-2"
    >
      {annotations.map((annot) => (
        <Annotation
          checkbox={
            selectable && (
              <Checkbox
                checked={selected.has(annot.key)}
                onChange={(checked) =>
                  checked ? add(annot.key) : remove(annot.key)
                }
              />
            )
          }
          collapsed={collapsed}
          key={annot.key}
          role="listitem"
          annotation={annot}
          tags={getTags(annot.key)}
        />
      ))}
    </div>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Checkbox({ checked, onChange }: CheckboxProps) {
  return (
    <div className="flex h-5 items-center">
      <input
        type="checkbox"
        className="m-0 h-4 w-4"
        checked={checked}
        onChange={(evt) => onChange(evt.target.checked)}
      />
    </div>
  );
}
