import Image from "next/image";

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-white">Job Founder Hunter - Vercel API</h1>
        <p className="text-gray-400 mb-8">Backend mail service with tracking</p>
        <div className="flex gap-4 justify-center">
          <Link href="/dashboard" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            📊 Open Dashboard
          </Link>
          <a href="/health" className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800">
            Health Check
          </a>
        </div>
      </div>
    </div>
  );
}

