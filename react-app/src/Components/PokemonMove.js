import React from 'react';


const PokemonMove = ( { name, url } ) => {
  return (
    <div>
      <h3>move name is : {name}</h3>
      <h5>url is : <a href={url}>{url}</a></h5>
    </div>
  );
}
  export default PokemonMove;