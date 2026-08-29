import Sound from "react-native-sound";

Sound.setCategory("Playback");

class CallSoundService {
  incomingRingtone = null;
  outgoingRingback = null;

  startIncomingRingtone() {
    this.stopAll();

    this.incomingRingtone = new Sound(
      "incoming_ringtone.mp3",
      Sound.MAIN_BUNDLE,
      (error) => {
        if (error) {
          console.log("INCOMING RINGTONE LOAD ERROR:", error);

          return;
        }

        console.log("INCOMING RINGTONE START");

        this.incomingRingtone.setNumberOfLoops(-1);

        this.incomingRingtone.play((success) => {
          console.log("INCOMING RINGTONE FINISHED:", success);
        });
      },
    );
  }
  // startIncomingRingtone() {
  //     console.log("START INCOMING RINGTONE");

  //     this.stopAll();

  //     this.incomingRingtone = new Sound(
  //         "incoming_ringtone.mp3",
  //         Sound.MAIN_BUNDLE,
  //         error => {
  //             if (error) {
  //                 console.log("RINGTONE LOAD ERROR:", error);
  //                 return;
  //             }

  //             console.log("RINGTONE LOADED");

  //             this.incomingRingtone.setVolume(1.0);
  //             this.incomingRingtone.setNumberOfLoops(-1);

  //             console.log(
  //                 "DURATION:",
  //                 this.incomingRingtone.getDuration()
  //             );

  //             console.log(
  //                 "VOLUME:",
  //                 this.incomingRingtone.getVolume()
  //             );

  //             this.incomingRingtone.play(success => {
  //                 console.log("RINGTONE PLAY CALLBACK:", success);
  //             });

  //             console.log("RINGTONE PLAY CALLED");
  //         }
  //     );
  // }

  startOutgoingRingback() {
    this.stopAll();

    this.outgoingRingback = new Sound(
      "outgoing_ringback.mp3",
      Sound.MAIN_BUNDLE,
      (error) => {
        if (error) {
          console.log("OUTGOING RINGBACK LOAD ERROR:", error);

          return;
        }

        console.log("OUTGOING RINGBACK START");

        this.outgoingRingback.setNumberOfLoops(-1);

        this.outgoingRingback.play((success) => {
          console.log("OUTGOING RINGBACK FINISHED:", success);
        });
      },
    );
  }

  stopAll() {
    if (this.incomingRingtone) {
      this.incomingRingtone.stop();

      this.incomingRingtone.release();

      this.incomingRingtone = null;
    }

    if (this.outgoingRingback) {
      this.outgoingRingback.stop();

      this.outgoingRingback.release();

      this.outgoingRingback = null;
    }

    console.log("CALL SOUNDS STOPPED");
  }

  //     stopAll() {

  //     console.log("================================");
  //     console.log("STOPPING ALL CALL SOUNDS");
  //     console.log("incomingRingtone:", !!this.incomingRingtone);
  //     console.log("outgoingRingback:", !!this.outgoingRingback);
  //     console.log("================================");

  //     if (this.incomingRingtone) {
  //         const ringtone = this.incomingRingtone;

  //         this.incomingRingtone = null;

  //         try {
  //             ringtone.stop(() => {
  //                 console.log("INCOMING RINGTONE STOPPED");
  //                 ringtone.release();
  //             });
  //         } catch (error) {
  //             console.log("INCOMING STOP ERROR:", error);

  //             try {
  //                 ringtone.release();
  //             } catch (e) {}
  //         }
  //     }

  //     if (this.outgoingRingback) {
  //         const ringback = this.outgoingRingback;

  //         this.outgoingRingback = null;

  //         try {
  //             ringback.stop(() => {
  //                 console.log("OUTGOING RINGBACK STOPPED");
  //                 ringback.release();
  //             });
  //         } catch (error) {
  //             console.log("OUTGOING STOP ERROR:", error);

  //             try {
  //                 ringback.release();
  //             } catch (e) {}
  //         }
  //     }

  //     console.log("CALL SOUNDS STOP REQUESTED");
  // }
}

export default new CallSoundService();
