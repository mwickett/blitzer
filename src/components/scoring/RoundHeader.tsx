interface RoundHeaderProps {
  title: string;
  subtitle: string;
}

export function RoundHeader({ title, subtitle }: RoundHeaderProps) {
  return (
    <div className="px-5 pt-4 pb-2 bg-[#fff7ea] sticky top-0 z-20 border-b border-[#f0e6d2]">
      <h2 className="text-lg font-bold text-[#290806]">{title}</h2>
      <div className="text-xs text-[#8b5e3c]">{subtitle}</div>
    </div>
  );
}
