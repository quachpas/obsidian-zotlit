export const mergeAnnotationPattern = /^<!--merge:(\w+)-->/;

export function toMergedAnnotation(
  comment: string | null,
  mainKey: string,
  isMain: boolean,
) {
  const prefix = `<!--merge:${mainKey}-->`;
  return (
    (!isMain ? prefix : "") +
    (comment?.replace(mergeAnnotationPattern, "") ?? "")
  );
}
