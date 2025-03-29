import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-gray-100 border-t border-gray-200 mt-auto pt-2">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div className="flex items-center mb-6 md:mb-0">
            <Image
              src="/img/blitzer-logo.png"
              width={60}
              height={60}
              alt="Blitzer logo"
              className="mr-4"
            />
            <div className="text-left">
              <h3 className="text-lg font-bold text-brandAccent">Blitzer</h3>
              <p className="text-sm text-gray-600">
                Score tracking for Dutch Blitz
              </p>
            </div>
          </div>

          <div className="flex space-x-8">
            <Link
              href="/dashboard"
              className="text-gray-700 hover:text-brandAccent transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/games"
              className="text-gray-700 hover:text-brandAccent transition-colors"
            >
              Games
            </Link>
            <Link
              href="/friends"
              className="text-gray-700 hover:text-brandAccent transition-colors"
            >
              Friends
            </Link>
            <a
              href="https://wickett.notion.site/Vision-for-Blitzer-a802db0123d54ef6881598c67cd4a147?pvs=4"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-brandAccent transition-colors"
            >
              About
            </a>
          </div>
        </div>

        <div className="h-px w-full bg-gray-200 my-8"></div>

        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-600 mb-4 md:mb-0">
            © {new Date().getFullYear()} Blitzer. All rights reserved.
          </p>
          <p className="text-sm text-gray-600">
            For scoring and tracking statistics for{" "}
            <a
              href="https://www.dutchblitz.com"
              className="text-brandAccent hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              Dutch Blitz
            </a>
            , the fast-paced, multiplayer card game.
          </p>
        </div>
      </div>
    </footer>
  );
}
