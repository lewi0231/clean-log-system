function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Pin */}
          <path
            d="M12 22s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* “Form fields” */}
          <path
            d="M9 9h6M9 12h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Check */}
          <path
            d="m9.2 15.2 1.2 1.2 3-3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="text-2xl font-semibold tracking-tight">
        <span>Fieldly</span>
      </div>
    </div>
  );
}

export default Logo;
