import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
          
          <div className="space-y-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Information We Collect</h2>
              <p>
                prologue.run does not require a login, and we do not provide a way for users to upload data. 
                We do not collect personal information such as names, email addresses, or phone numbers 
                unless you contact us directly.
              </p>
              <p className="mt-4">
                We use standard web analytics to understand how our site is used. 
                This data is anonymous and helps us improve the user experience.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Imagery and Privacy</h2>
              <p>
                Our 360° imagery is captured in public spaces. We respect individual privacy and 
                strive to ensure that faces and license plates are obscured.
              </p>
            </section>

            <section className="bg-slate-900/50 p-6 rounded-xl border border-white/5">
              <h2 className="text-2xl font-semibold text-white mb-4">3. Content Removal Requests</h2>
              <p className="mb-4">
                If you appear in a photo or 360° view on prologue.run and wish to be removed, please contact us at 
                <a href="mailto:hello@prologue.run" className="text-coral hover:underline ml-1">hello@prologue.run</a>.
              </p>
              <p className="font-semibold text-white mb-2">To process your request, you must:</p>
              <ul className="list-disc ml-6 space-y-2 mb-4">
                <li>Include the exact link to the view where you are visible.</li>
                <li>Submit proof that you are the person in the imagery.</li>
              </ul>
              <p className="italic">
                Note: We will only blur your face and other identifying features. Publicly available 
                information, such as store signage or race bib numbers, will not be removed.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Cookies</h2>
              <p>
                We may use cookies to remember your preferences and improve your experience. 
                You can choose to disable cookies in your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Third-Party Links</h2>
              <p>
                Our site may contain links to other websites. We are not responsible for the 
                privacy practices or content of these third-party sites.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at 
                <a href="mailto:hello@prologue.run" className="text-coral hover:underline ml-1">hello@prologue.run</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
