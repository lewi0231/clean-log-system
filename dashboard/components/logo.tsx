import { WashingMachine } from "lucide-react";

function Logo() {
  return (
    <div className="flex justify-start items-center gap-0.5">
      <WashingMachine />
      <div className="flex items-center text-2xl font-semibold tracking-tight">
        <span className="">Clean</span>
        <span>Log</span>
      </div>
    </div>
  );
}

export default Logo;
