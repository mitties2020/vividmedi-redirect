# CareQuay demo

CareQuay is a local, front-end demonstration for a Western Australian Mental Health Hospital in the Home service. It is designed to show a shared patient and care-team experience without connecting to a clinical system or sending real information.

## Open the demo

Open `index.html` in a modern browser. Use access code `931986` and select either **Patient** or **Care team**.

## Included in this prototype

- Daily home-visit and telehealth preferences
- Collaborative, seven-part patient safety plan
- Optional support-person details and sharing preference
- Clear lower-acuity and urgent-support pathways
- Non-urgent care-team updates, including medication supply concerns
- Pharmacy details placeholder and Healthdirect service-finder link
- Small patient-led recovery goals
- K10+, PHQ-9, GAD-7 and WHO-5 self-report demonstrations
- Care-team overview of requests, messages, safety-plan completion and progress
- Responsive layout and print styling for the safety plan

## Important limits

- This is a prototype, not a WA Health service or medical device.
- Nothing is sent, monitored or stored in a clinical record.
- Demo entries are saved only in browser `localStorage`, which is not appropriate for real patient data.
- The shared access code is suitable only for a demonstration. A pilot would need WA Health-approved identity, access control, consent, audit, security, privacy and records-management design.
- Pharmacy auto-lookup needs an approved directory/data source before it can safely return contact information.
- The questionnaires support discussion and must not be used alone to diagnose, predict suicide, determine treatment or make discharge decisions.

## Reused ideas

The prototype adapts the access-code gate, local appointment-storage approach and compact clinical workflow patterns from the public `mitties2020/clinical-qa` / VividMedi project. CareQuay’s interface, patient flow, safety plan, progress tools and care-team view are new.

