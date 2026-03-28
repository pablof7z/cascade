export default function Footer() {
  return (
    <footer className="w-full py-4 mt-auto border-t border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 flex justify-center">
        <span className="text-xs text-neutral-500">
          Build: {__COMMIT_HASH__}
        </span>
      </div>
    </footer>
  )
}
