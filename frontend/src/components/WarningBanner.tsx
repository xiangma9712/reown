export function WarningBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-warning/30 bg-warning/10 px-3 py-1.5 text-[0.8rem] text-warning">
      <span>&#x26A0;&#xFE0F;</span>
      <span>{message}</span>
    </div>
  );
}
