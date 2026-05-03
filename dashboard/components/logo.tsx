import { APP_DISPLAY_NAME } from "@/lib/brand";
import Image from "next/image";

function Logo() {
  return (
    <Image
      src="/logo.png"
      alt={APP_DISPLAY_NAME}
      width={180}
      height={48}
      priority
      className="h-10 w-auto"
    />
  );
}

export default Logo;
