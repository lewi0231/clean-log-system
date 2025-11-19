import Logo from "@/components/logo";

export default function Home() {
  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="flex flex-col items-center justify-center gap-6 text-center">
        <Logo />
        <p className="text-lg text-muted-foreground max-w-2xl">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat.
        </p>
      </div>
    </div>
  );
}
