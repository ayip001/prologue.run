import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
          
          <div className="space-y-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using prologue.run, you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Service</h2>
              <p>
                prologue.run provides interactive 360° street-level imagery of race routes for preview purposes. 
                The service is provided "as is" and "as available". We do not require user accounts, 
                and there is no facility for users to upload content.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Use of Content</h2>
              <p>
                All imagery and data provided on prologue.run are for personal, non-commercial use only. 
                You may not scrape, download, or redistribute the content without explicit permission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Privacy and Data</h2>
              <p>
                Our collection and use of data are governed by our Privacy Policy. 
                Since we do not offer accounts or uploads, we do not store personal user data 
                beyond standard web analytics.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Limitation of Liability</h2>
              <p>
                prologue.run is not responsible for any inaccuracies in the imagery or route data. 
                Users should rely on official race information for accurate course details. 
                We are not liable for any damages arising from the use of this service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Changes to Terms</h2>
              <p>
                We reserve the right to modify these terms at any time. Your continued use of the service 
                following any changes constitutes acceptance of the new terms.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
