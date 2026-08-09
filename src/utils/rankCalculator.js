import levels from "../data/levels";


function getRank(totalXP) {


  let currentRank = levels[0];


  for (const rank of levels) {

    if(totalXP >= rank.requiredXP){

      currentRank = rank;

    }

  }


  return currentRank;

}


export default getRank;