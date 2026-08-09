import missions from "../data/missions";


function checkMissions(user) {


  const unlocked = [];


  missions.forEach((mission)=>{


    if(
      user.completedMissions.includes(
        mission.id
      )
    ){

      return;

    }



    if(
      mission.type === "trades" &&
      user.tradesCompleted >= mission.requirement
    ){

      unlocked.push(mission);

    }


  });


  return unlocked;

}


export default checkMissions;