import React, { useState, createContext, useEffect } from "react";
import axios from "axios";

export const PokemonContext = createContext();

const PokemonContextProvider = props => {
  const [pokemon, setPokemon] = useState([]);
  const [load, setLoad] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get("https://pokeapi.co/api/v2/type/3")
      .then(res => {
        setPokemon(res.data.moves);
        setLoad(true);
      })
      .catch(err => {
        setError(err.message);
        setLoad(true);
      });
  }, []);

  return (
    <PokemonContext.Provider value={{ pokemon, setPokemon }}>
      {props.children}
    </PokemonContext.Provider>
  );
};

export default PokemonContextProvider;