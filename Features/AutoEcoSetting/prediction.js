export const prediction = () => chrome.privacy.network.networkPredictionEnabled;

// Retirer notre consigne sans écraser un choix plus récent de l'utilisateur.
export async function releasePrediction(state) {
  await prediction().clear({ scope: "regular" });
  const after = await prediction().get({});
  if (after.levelOfControl === "controlled_by_this_extension") {
    throw new Error("Consigne encore active");
  }
  delete state.backup.prediction;
}
