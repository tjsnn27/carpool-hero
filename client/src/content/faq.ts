export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ: FaqItem[] = [
  {
    question: 'How does Carpool Hero work?',
    answer:
      'When your phone detects you have entered the school pickup zone, Carpool Hero automatically notifies the classroom so your child can walk to the car. Volunteers at the curb also see your arrival on the loading dock screen.',
  },
  {
    question: 'How does Carpool Hero know I\'m in line?',
    answer:
      'Your phone uses a privacy-safe geofence around the pickup zone configured by your school. When you enter that area, the app sends an arrival signal using your family placard tag — not your GPS coordinates.',
  },
  {
    question: 'Will Carpool Hero drain my battery?',
    answer:
      'Carpool Hero uses low-power geolocation settings recommended by Apple and Google. Location is only checked while the Driver screen is active. It uses no more battery than a typical navigation app running in the foreground.',
  },
  {
    question: 'Does Carpool Hero track my location?',
    answer:
      'No. Carpool Hero never stores, transmits, or shares your exact GPS coordinates. Your phone checks locally whether you are inside the pickup zone, then sends only your family tag number to the school. We believe your privacy is extremely important.',
  },
  {
    question: 'Why does my phone ask for location permission?',
    answer:
      'Apple and Google require location access for geofence features to work. Carpool Hero uses this only to detect proximity to the pickup zone — never to track, log, or share your exact location with the school or anyone else.',
  },
  {
    question: 'Do I have to use the app while driving?',
    answer:
      'No! Open the Driver screen before you leave home or when you are stopped. Once auto-arrival is enabled, you never need to touch your phone while driving. The app notifies the school automatically when you enter the pickup zone.',
  },
  {
    question: 'What if I don\'t have a smartphone?',
    answer:
      'Drivers without the app can still pick up children. A volunteer at the curb will enter your placard number on the Lane Check-In keypad. Wait times may be slightly longer, but dismissal works the same way.',
  },
  {
    question: 'Can other drivers pick up my kids?',
    answer:
      'Yes. Your family placard tag is shared with anyone authorized to pick up your children. Share your tag number with grandparents, carpools, or other drivers. Authorized pickup names are visible to loading volunteers for verification.',
  },
  {
    question: 'Does my child need the app on their phone?',
    answer:
      'No. Carpool Hero is only installed on driver phones and on school devices (classroom board, volunteer check-in). Students are notified through the classroom dismissal screen when you arrive.',
  },
  {
    question: 'How do I see if my child has been picked up?',
    answer:
      'The Driver screen shows live status for each child: In Class → Staged (walking to car) → Loaded (safely departed). Status updates in real time without refreshing.',
  },
];
