const WATCH_FOR = [
  'are pregnant or recently postpartum',
  'have severe or worsening pain',
  'have acute lumbar disc herniation or active spinal injury',
  'have spinal stenosis or conditions where flexion/extension may be contraindicated',
  'have recent surgery, fracture, neurological symptoms, numbness, weakness, or loss of bladder/bowel control',
  'have been advised by a clinician to avoid certain movements',
]

export default function HealthNoticeContent({ showRecoveryReminder }: { showRecoveryReminder?: boolean }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-medium mb-2">Health &amp; Safety Notice</h2>
        <p className="text-sm text-muted leading-relaxed">
          Forma provides general movement and Pilates guidance and is not a substitute for medical
          advice, diagnosis, physical therapy, or treatment.
        </p>
      </div>

      <div>
        <p className="text-sm text-charcoal font-medium mb-2">
          Before starting any session, please consult a qualified healthcare professional if you:
        </p>
        <ul className="space-y-1.5">
          {WATCH_FOR.map(item => (
            <li key={item} className="flex gap-2 text-sm text-muted leading-snug">
              <span className="text-sage mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-rose/30 bg-rose/7 p-4">
        <p className="text-sm text-charcoal leading-relaxed">
          <span className="font-semibold">Stop immediately and seek medical advice</span> if you
          experience sharp pain, dizziness, shortness of breath, chest pain, numbness, radiating
          pain, or symptoms that feel unsafe.
        </p>
      </div>

      {showRecoveryReminder && (
        <div className="rounded-2xl border border-sage/30 bg-sage/7 p-4">
          <p className="text-sm text-charcoal leading-relaxed">
            🌿 Because you selected recovery or pain-related goals, please move gently and consult
            a clinician if symptoms are acute or severe.
          </p>
        </div>
      )}

      <p className="text-sm text-muted leading-relaxed">
        By continuing, you confirm that you understand these risks and will use Forma responsibly
        within your own limits.
      </p>
    </div>
  )
}
