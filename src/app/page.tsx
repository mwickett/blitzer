import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  BarChart4,
  Trophy,
  Users,
  Activity,
  Clock,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-brand">
      {/* Hero Section */}
      <section className="px-6 py-12 md:py-20 flex flex-col items-center text-center">
        <div className="max-w-5xl mx-auto flex flex-col items-center">
          <div className="relative mb-10 w-[250px] h-[250px] md:w-[300px] md:h-[300px] flex items-center justify-center">
            <div className="absolute inset-0 bg-brandAccent/5 rounded-full animate-pulse"></div>
            <Image
              src="/img/blitzer-logo.png"
              width={300}
              height={300}
              alt="Blitzer logo - line drawing windmill with hearts"
              className="transition-transform hover:scale-105 duration-300 z-10"
              priority
            />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-brandAccent leading-tight mb-6">
            Track, Compete, Conquer
            <br />
            <span className="text-brandAccent">Dutch Blitz</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-700 mb-8 max-w-3xl mx-auto">
            Blitzer is the ultimate companion for serious Dutch Blitz players.
            Track scores, analyze statistics, compete with friends, and take
            your Dutch Blitz game to the next level.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <SignedIn>
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="font-semibold px-8 py-6 text-lg bg-brandAccent hover:bg-brandAccent/90"
                >
                  Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </SignedIn>
            <SignedOut>
              <div className="flex flex-col sm:flex-row gap-4">
                <SignUpButton>
                  <Button
                    size="lg"
                    className="font-semibold px-8 py-6 text-lg bg-brandAccent hover:bg-brandAccent/90"
                  >
                    Get Started <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </SignUpButton>
                <SignInButton>
                  <Button
                    size="lg"
                    variant="outline"
                    className="font-semibold px-8 py-6 text-lg border-brandAccent text-brandAccent"
                  >
                    Sign In
                  </Button>
                </SignInButton>
              </div>
            </SignedOut>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-brandAccent">
            Why Blitzer?
          </h2>
          <p className="text-center text-gray-600 max-w-3xl mx-auto mb-12">
            The perfect companion for Dutch Blitz enthusiasts who want to
            elevate their gaming experience
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-brand rounded-xl p-8 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-brandAccent/10">
              <div className="flex flex-col items-center mb-5 text-center">
                <div className="bg-brandAccent p-4 rounded-full text-white mb-4 shadow-md">
                  <BarChart4 className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-brandAccent">
                  Detailed Statistics
                </h3>
              </div>
              <div className="h-[2px] w-16 bg-brandAccent/20 mx-auto mb-5"></div>
              <p className="text-gray-700 text-center">
                Track your performance with comprehensive statistics including
                batting average, win rates, highest scores, and score trends
                over time.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-brand rounded-xl p-8 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-brandAccent/10">
              <div className="flex flex-col items-center mb-5 text-center">
                <div className="bg-brandAccent p-4 rounded-full text-white mb-4 shadow-md">
                  <Trophy className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-brandAccent">
                  Game History
                </h3>
              </div>
              <div className="h-[2px] w-16 bg-brandAccent/20 mx-auto mb-5"></div>
              <p className="text-gray-700 text-center">
                Keep a complete record of all your games with detailed
                round-by-round scoring, winners, and progress charts to track
                improvement.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-brand rounded-xl p-8 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-brandAccent/10">
              <div className="flex flex-col items-center mb-5 text-center">
                <div className="bg-brandAccent p-4 rounded-full text-white mb-4 shadow-md">
                  <Users className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-brandAccent">
                  Play with Friends
                </h3>
              </div>
              <div className="h-[2px] w-16 bg-brandAccent/20 mx-auto mb-5"></div>
              <p className="text-gray-700 text-center">
                Connect with friends, track scores together, and see who truly
                dominates at Dutch Blitz with competitive leaderboards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brandAccent/5 to-transparent opacity-70"></div>
        <div className="max-w-5xl mx-auto relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-brandAccent">
            How It Works
          </h2>
          <p className="text-center text-gray-600 max-w-3xl mx-auto mb-16">
            Start tracking your Dutch Blitz games in three simple steps
          </p>

          <div className="grid md:grid-cols-3 gap-12 text-center relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-brandAccent/20 -translate-y-1/2 hidden md:block"></div>

            {/* Step 1 */}
            <div className="flex flex-col items-center relative bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <div className="bg-brandAccent text-white rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold mb-6 shadow-lg absolute -top-8 transform hover:scale-110 transition-transform">
                1
              </div>
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4 text-brandAccent">
                  Create a Game
                </h3>
                <p className="text-gray-700">
                  Start a new game session and add players from your friends
                  list. Set up your game in seconds and get ready to play.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center relative bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <div className="bg-brandAccent text-white rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold mb-6 shadow-lg absolute -top-8 transform hover:scale-110 transition-transform">
                2
              </div>
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4 text-brandAccent">
                  Record Scores
                </h3>
                <p className="text-gray-700">
                  After each round, enter scores for all players. Track your
                  progress in real-time as the game unfolds.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center relative bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <div className="bg-brandAccent text-white rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold mb-6 shadow-lg absolute -top-8 transform hover:scale-110 transition-transform">
                3
              </div>
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4 text-brandAccent">
                  Analyze Results
                </h3>
                <p className="text-gray-700">
                  View detailed statistics, track improvement over time, and see
                  who&apos;s the ultimate Blitz champion in your group.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-brandAccent text-white text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-white to-transparent opacity-10"></div>
        <div className="absolute bottom-0 right-0 w-full h-20 bg-gradient-to-t from-black/20 to-transparent"></div>
        <div className="absolute -left-10 top-10 w-40 h-40 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute -right-10 bottom-10 w-40 h-40 rounded-full bg-white/10 blur-3xl"></div>

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="mb-12 transform hover:scale-105 transition-transform duration-500">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to Elevate Your Dutch Blitz Experience?
            </h2>
            <div className="h-1 w-24 bg-white/30 mx-auto rounded-full mb-6"></div>
            <p className="text-xl mb-8 text-white/90">
              Join Blitzer today and start tracking your Dutch Blitz journey
              with friends.
            </p>
          </div>

          <SignedOut>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <SignUpButton>
                <Button
                  size="lg"
                  className="font-semibold px-8 py-6 text-lg bg-white text-brandAccent hover:bg-gray-100 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Get Started <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </SignUpButton>
              <a
                href="https://wickett.notion.site/Vision-for-Blitzer-a802db0123d54ef6881598c67cd4a147?pvs=4"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="secondary"
                  size="lg"
                  className="font-semibold px-8 py-6 text-lg hover:bg-white/20 transition-all duration-300 bg-transparent border border-white text-white"
                >
                  Learn More
                </Button>
              </a>
            </div>
          </SignedOut>
          <SignedIn>
            <Link href="/games/new">
              <Button
                size="lg"
                className="font-semibold px-10 py-6 text-lg bg-white text-brandAccent hover:bg-gray-100 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Start a New Game <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-12">
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
    </main>
  );
}
