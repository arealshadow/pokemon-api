import React, { useContext } from "react";
import PokemonMove from './PokemonMove';
import { PokemonContext } from "./PokemonContext";

const PokemonDisplay = () => {
  const { pokemon } = useContext(PokemonContext);

  console.log("api works", pokemon);
  
  var l=pokemon.length;
  var first = null;
  if(l>0){
      first=pokemon[5];
  }
  return (
    <div>
    { l>0 &&
      <div>
        <h2>First poke is {pokemon[0].name}  adasdasdad {first.name}</h2>
        
        </div>
    }
    <h2>test: {first?.name}</h2>
            
      <h2>The following move: 
      {
         
          pokemon.map((poke, i) => {
          return (
            <PokemonMove 
              key={i}
              name={poke.name}
              url={poke.url}
              />
          )
              
            

             }
          )
      }</h2>
     
    </div>
  );
};

export default PokemonDisplay;
